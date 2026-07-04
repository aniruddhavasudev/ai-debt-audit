import pickle
from flask import Flask, render_template_string

app = Flask(__name__)
app.secret_key = "supersecretflaskkey123"

@app.route("/greet")
def greet(request):
    name = request.args.get("name")
    return render_template_string(f"Hello {name}")

@app.route("/profile")
def profile():
    user = User.query.filter_by(id=1).first()
    return str(user)

def load_session(data):
    return pickle.loads(data)

if __name__ == "__main__":
    app.run(debug=True)

from flask_cors import CORS
CORS(app, resources={r"/*": {"origins": "*"}})
