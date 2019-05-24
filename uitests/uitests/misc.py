from azure.cognitiveservices.vision.computervision import ComputerVisionClient
from azure.cognitiveservices.vision.computervision.models import VisualFeatureTypes
from msrest.authentication import CognitiveServicesCredentials
from azure.cognitiveservices.vision.computervision.models import TextRecognitionMode
from azure.cognitiveservices.vision.computervision.models import TextOperationStatusCodes
import time

# Get endpoint and key from environment variables
import os
endpoint = "xx"
key = "xx"

# Set credentials
credentials = CognitiveServicesCredentials(key)

# Create client
client = ComputerVisionClient(endpoint, credentials)

#%%
# domain = "landmarks"
# url = "http://www.public-domain-photos.com/free-stock-photos-4/travel/san-francisco/golden-gate-bridge-in-san-francisco.jpg"
# language = "en"
# max_descriptions = 3

# analysis = client.describe_image(url, max_descriptions, language)

# for caption in analysis.captions:
#     print(caption.text)
#     print(caption.confidence)

#%%
# url = "https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/Broadway_and_Times_Square_by_night.jpg/450px-Broadway_and_Times_Square_by_night.jpg"

# image_analysis = client.analyze_image(url,visual_features=[VisualFeatureTypes.tags])

# for tag in image_analysis.tags:
#     print(tag)

#%%
url = "https://user-images.githubusercontent.com/1948812/57894667-877b9d00-77fc-11e9-97e9-405edee1e2d0.png"
# mode = TextRecognitionMode.handwritten
mode = TextRecognitionMode.printed
raw = True
custom_headers = None
numberOfCharsInOperationId = 36

# Async SDK call
# rawHttpResponse = client.batch_read_file(url, mode, custom_headers, raw)

with open("/Users/donjayamanne/Desktop/Screen Shot 2019-05-16 at 7.40.41 PM.png", "rb") as fp:
	rawHttpResponse = client.batch_read_file_in_stream(fp, mode, custom_headers,  raw)

# Get ID from returned headers
operationLocation = rawHttpResponse.headers["Operation-Location"]
idLocation = len(operationLocation) - numberOfCharsInOperationId
operationId = operationLocation[idLocation:]

# SDK call
while True:
    result = client.get_read_operation_result(operationId)
    if result.status not in ['NotStarted', 'Running']:
        break
    time.sleep(1)

# Get data
if result.status == TextOperationStatusCodes.succeeded:
    for textResult in result.recognition_results:
        for line in textResult.lines:
            print(line.text)
            # print(line.bounding_box)
