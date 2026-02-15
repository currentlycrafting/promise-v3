import os
from dotenv import load_dotenv
from google import genai


load_dotenv()



API_KEY = os.getenv("GEMINI_API_KEY")

if not API_KEY:
    raise ValueError("No key")


# make client


client = genai.Client(api_key = API_KEY)


def refine_promise(promise, issue, category):
    if not promise:
        return "promise is empty; no promise provided"

    prompt = f" Given the current promise: {promise} this person was not able to keep this promise due to this issue: {issue}  and ths specific category: {category}.  they want to refine the promise and make it more into a more reasonable promise with regard to improve their issue({issue}) and category({category}).  DO NOT change the original premise of the promise, just make it more 'doable'. your response format should be: 'refined Promise': [new promise] \n 'Why this works[reasoning]. nothing more. your output should just give use the new promise and a very short and concise reasoning as to why. when you are giving the reaosning, speak directly as if you're talking to the person who gave you this promise and issue "

    try:
        response = client.models.generate_content(
            model = "gemini-2.5-flash",
            contents = prompt
        )
        return response.text
    
    except Exception as e:
        return f"Error:{e}"