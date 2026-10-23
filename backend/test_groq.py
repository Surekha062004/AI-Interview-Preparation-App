
import os
from dotenv import load_dotenv
from groq import Groq, APIError

load_dotenv()

api_key = os.getenv("GROQ_API_KEY")
model = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b")

if not api_key:
    print("ERROR: GROQ_API_KEY was not loaded from .env")
    raise SystemExit(1)

print("API key loaded:", bool(api_key))
print("Model:", model)

try:
    client = Groq(api_key=api_key)

    result = client.chat.completions.create(
        model=model,
        messages=[
            {
                "role": "user",
                "content": "Explain React hooks in two simple sentences."
            }
        ],
        max_completion_tokens=200,
    )

    print("\nSUCCESS!")
    print(result.choices[0].message.content)

except APIError as exc:
    print("\nGROQ API ERROR")
    print("HTTP status:", getattr(exc, "status_code", None))
    print("Error details:", str(exc))

except Exception as exc:
    print("\nOTHER ERROR")
    print(type(exc).__name__, str(exc))
