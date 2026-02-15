from gemini_client import refine_promise 
import time 

promise = input("Enter a promise: ") #"I want to work out for 2 hours eevry single day"
print("Choose a timer:")
print("1. 5 seconds")
print("2. 10 seconds")
print("3. 15 seconds")
promise_time = input("Enter 1,2, or 3: ")


if promise_time == "1":
    seconds = 5
elif promise-time == "2":
    seconds = 10
elif promise-time == "3":
    seconds = 15
else:
    print('Invalid Choice')
    exit()


time.sleep(seconds)

update = input("Did you keep your promise?(Y/N): ")

if update == "n" or update == "N":
    issue =input("Enter the issue you currently have with acheiving this promise: ") #"I have too many things in my agenda"
    print("Pick which category you feel like this issue is apart of. Choose 1,2,or 3: \n 1. Time \n 2. Lack of Resource(s) \n 3. Too much friction \n ")
    pre_category = input("Enter 1,2, or 3: ")

    if int(pre_category) == 1:
        category = "Time"
    elif int(pre_category) == 2:
        category = "Lack of Resource(s)"
    elif int(pre_category) == 3:
        category = "Too much friction"
    else:
        print('Not a valid option')
    print(refine_promise(promise, issue, category))

elif update == "y" or update == "Y":
    print("Promise kept!")

else:
    print('Invalid option')








