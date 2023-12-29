from flask import Flask
from flask import request
from flask_cors import CORS, cross_origin

import logging
import concurrent.futures
import json
import os
import requests

from openai import OpenAI
import time

# set up connections to the APIs
hn_api = "https://hacker-news.firebaseio.com/v0/user/{}.json"
cur_story = 0
user = "whoishiring"
hn_stories = requests.get(hn_api.format(user)).json().get("submitted")
newest_story_id = int(hn_stories[0])
assistant_id = None

def respond(structured_response):
	return structured_response

# create the assistant and return 
def configure_assistant(client, file_name):
	app.logger.info('Configuring assistant. This can take time.')
	app.logger.info('Checking for existing assistant')
	assistant_list = client.beta.assistants.list()
	assistant = next((item for item in assistant_list if item.name == "Who's Hiring Search"), None)
	if assistant == None:
		file = client.files.create(
			file = open(file_name, "rb"),
			purpose = 'assistants'
		)
		app.logger.info('No matching assistant, creating new assistant')
		assistant = client.beta.assistants.create(
			name="HN Hiring Search",
			instructions='You are a helpful recruiter. You use the retrieval tool to pull all listings that you know from the retrieval tool that match the requirements of the job seeker. Listings are in the format { "listing_id": int, "listing_text": string }. The source is relevant. The text contains information about the location, which role or roles are available, the company, and if the role is on site. Applicants may ask to filter on any of those attributes. These listings should only be retrieved from the retrieval tool.',
			tools=[{
					"type": "retrieval"
				}, {
					"type": "function",
					"function": {
						"name": "respond",
						"description": "Respond to the user in a structured manner.",
						"parameters": {
							"properties": {
							"structured_response": {
								"type": "object",
								"description": "Your structured response. Only accepts JSON format!",
								"properties": {
								"listing_ids": {
									"type": "array",
									"description": "The array of matching source results",
									"items": {
									"type": "string"
									}
								}
								}
							}
							},
							"required": [
							"structured_response"
							],
							"type": "object"
						}
					}
				}
			],
			model="gpt-4-1106-preview",
			file_ids = [file.id]
		)
	else:
		app.logger.info('found existing assistant, updating the file with most recent scraping')
		file_list = client.files.list()
		file_id = next((item.id for item in file_list if item.filename == file_name), None)
		if file_id is not None:
			deleted_file = client.files.delete(
				file_id = file_id,
			)
			app.logger.info('Deleted existing file')
		app.logger.info('Adding new file')
		file = client.files.create(
			file = open(file_name, "rb"),
			purpose = 'assistants'
		)
		assistant_file = client.beta.assistants.files.create(
			assistant_id=assistant.id,
			file_id=file.id
		)
	return assistant

def handle_search(client, user_input, listings):
	run = client.beta.threads.create_and_run(
		assistant_id=assistant_id,
		thread={
			"messages": [
				{"role": "user", "content": f'Give me each applicable listing_id for the query: {user_input}. There should be more than one result. This should be the 8 digit listing_id. Do not ask if I want more results, just provide them.'}
			]
		}
	)
	app.logger.info('Executing new assistant run')
	result = poll_for_results(client, run, listings)
	app.logger.info('Recursive poll finished')
	return result

def poll_for_results(client, run, listings):
	while run.status in ['queued', 'in_progress']:
		time.sleep(0.05)
		run = client.beta.threads.runs.retrieve(
			thread_id=run.thread_id,
			run_id=run.id
		)
	if run.status == "requires_action":
		for tool_call in run.required_action.submit_tool_outputs.tool_calls:
			name = tool_call.function.name
			arguments = json.loads(tool_call.function.arguments)
			app.logger.info(f'Tool requested: {name} | {arguments})')
			output = respond(**arguments)
			for listing in output['listing_ids']:
				app.logger.info(f'added new listing {listing}')
				listings.add(listing)
			app.logger.info(f'Assistant provided {tool_call.id} {output}')
			run = client.beta.threads.runs.submit_tool_outputs(thread_id=run.thread_id, 
				run_id=run.id, 
				tool_outputs=[{
					'tool_call_id': tool_call.id,
					'output': json.dumps(output)
			}])
		return poll_for_results(client, run, listings)
	if run.status == "failed":
		app.logger.info('Run failed')
		raise Exception('Run failed')
	else:
		message_list = client.beta.threads.messages.list(
			thread_id=run.thread_id,
			order="asc"
		)
		app.logger.info(message_list.data[1].content[0].text.value)
		return { 'listings': listings, 'message': message_list.data[1].content[0].text.value }

def get_comment(comment_id):
	commentText = requests.get(f"https://hacker-news.firebaseio.com/v0/item/{comment_id}.json").json().get('text')
	return {
		'source': comment_id,
		'text': commentText
	}

def write_comments_to_file(num_months):
	documents = []
	for index in range(num_months):
		story_id = hn_stories[index]
		app.logger.info(f'Retrieving comments for story {story_id}')
		story = requests.get(f"https://hacker-news.firebaseio.com/v0/item/{story_id}.json").json()
		# create a document with the story's relevant information
		app.logger.info(story.get("descendants"))
		document = {
			"title": story.get("title"),
			"url": story.get("url"),
			"score": story.get("score"),
			"comments": story.get("kids"),
			"time": story.get("time"),
			"id": story.get("id"),
			"type": story.get("type"),
			"by": story.get("by"),
		}
		with open(str(hn_stories[index]) + "-comments.json", "w") as f:
			with concurrent.futures.ThreadPoolExecutor(max_workers=30) as executor:
				future_to_comment = {executor.submit(get_comment, comment_id): comment_id for comment_id in document.get('comments')}
				for future in concurrent.futures.as_completed(future_to_comment):
					comment = future.result()
					reformatted_comment = { "listing_id": comment.get('source'), "listing_text": comment.get('text')}
					documents.append((reformatted_comment))
				executor.shutdown()
				json_documents = {'comments': documents}
				temp_dumped_json = json.dumps(json_documents)
				chars_to_write = 650000 - len(temp_dumped_json)
				if chars_to_write > 0:
					app.logger.info('Below indexing threshold. Adding filler document to enforce vector search from assistant')
					filler_document = {
						'listing_id': '00000000',
						'listing_text': 'a' * chars_to_write
					}
					documents.append(filler_document)
					json_documents = {'comments': documents}
				f.write(json.dumps(json_documents))
				app.logger.info('Wrote comments to ' + f.name)
				return f.name

app = Flask(__name__)
CORS(app)

@app.route('/ask', methods=['GET', 'POST'])
@cross_origin()
def ask_route():
	app.logger.info(request.form)
	question=request.form["question"]
	app.logger.info(question)
	try:
		listings = set()
		app.logger.info('Dispatching request to OpenAI handler')
		result = handle_search(client, question, listings)
		return {
			'searchResults': list(result['listings']),
			'message': result['message']
		}
	except json.JSONDecodeError as e:
		app.logger.info(f'Error decoding JSON: {e}')
	except Exception as e:
		app.logger.info(f'Error occurred: {e}')

@app.route('/getStories', methods=['GET'])
@cross_origin()
def search_route():
	# todo: add in a story limit and return the slice of the hn_stories that is relevant
	return {'stories': [ newest_story_id ]}

@app.route('/', methods=['GET'])
@cross_origin()
def default_route():
	return {'message': 'Hello World'}

if __name__ == '__main__':
	api_key = os.environ['OPENAI_API_KEY']
	client = OpenAI(api_key=api_key)
	logging.basicConfig(level=logging.INFO)
	app.logger.info('Created OpenAI client')
	# TODO: implement handling more than one month
	file_name = write_comments_to_file(num_months=1)
	assistant = configure_assistant(client, file_name)
	assistant_id = assistant.id
	app.run(host='0.0.0.0')