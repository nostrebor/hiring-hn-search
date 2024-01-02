## Overview
This repository contains the frontend and backend code to query the most recent HackerNews "Who's Hiring" thread using OpenAI assistants.

## Launching the Application
To launch the application
* Set your OpenAI API Key in the .env file.
* Run `docker compose up`.
* * On linux systems, if you don't want to use docker, `./launch.sh` should yield similar results. I have had problems with Pydantic as a dependency on occasion - the docker build works reliably.

## Refreshing the comments
Relaunching the application will rebuild your assistant with the most recent comments.
