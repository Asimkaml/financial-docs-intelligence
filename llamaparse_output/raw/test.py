import json
with open("llamaparse_output/raw/sys_hf_26.json", "r", encoding="utf-8") as f:
    result = json.load(f)
# dict_keys(['job', 'forms', 'images_content_metadata', 'items', 'job_metadata', 'markdown', 'markdown_full', 'metadata', 'raw_parameters', 'result_content_metadata', 'text', 'text_full', 'debug'])
print(result.markdown)