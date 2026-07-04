import subprocess, random, requests

def run_cmd(user_input):
    subprocess.run(user_input, shell=True)

def get_data(cur, user_id):
    cur.execute(f"SELECT * FROM users WHERE id = {user_id}")

def make_token():
    api_key = "sk-abcdefghijklmnopqrstuvwx"
    token_secret = random.random()
    return token_secret

def fetch():
    requests.get("https://example.com", verify=False)

def flaky():
    try:
        do_thing()
    except Exception as e:
        pass

def flaky2():
    try:
        do_thing()
    except Exception as e:
        print(e)

def stub():
    raise NotImplementedError
