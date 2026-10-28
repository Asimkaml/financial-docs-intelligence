
class LLMContentNormalizer:
    """Normalizes AIMessage(Chunk).content across LangChain chat model providers.

    ChatOllama always returns content as a plain str. ChatGoogleGenerativeAI
    (and other providers, e.g. Anthropic/OpenAI in multimodal or tool-mixed
    responses) can return a list of content-part dicts instead — commonly
    [{"type": "text", "text": "..."}], sometimes interleaved with non-text
    parts (thinking blocks, function-call echoes, etc.) depending on provider.
    Any code doing str concatenation or .strip() on .content breaks the
    moment a provider returns the list form.
    """

    @staticmethod
    def to_text(content) -> str:
        if isinstance(content, str):
            return content
        if content is None:
            return ""
        if isinstance(content, list):
            return "".join(
                part.get("text", "") if isinstance(part, dict) and part.get("type") == "text"
                else (part if isinstance(part, str) else "")
                for part in content
            )
        return str(content)