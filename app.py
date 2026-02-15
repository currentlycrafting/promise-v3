from gemini_client import refine_promise 




promise = input("Enter a promise: ") #"I want to work out for 2 hours eevry single day"


issue =input("Enter the issue you currently have with acheiving this promise: ") #"I have too many things in my agenda"
pre_category = input(f"Pick which category you feel like this issue is apart of. Choose 1,2,or 3: \n 1. Time \n 2. Lack of Resource(s) \n 3. Too much friction \n ")

if int(pre_category) == 1:
    category = "Time"
elif int(pre_category) == 2:
    category = "Lack of Resource(s)"
elif int(pre_category) == 3:
    category = "Too much friction"
else:
    print('Not a valid option')


print(refine_promise(promise, issue, category))





