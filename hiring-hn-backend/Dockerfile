FROM python:3.11

COPY . /tmp
WORKDIR /tmp

RUN pip install -r requirements.txt

EXPOSE 5000

ENTRYPOINT python search_api.py