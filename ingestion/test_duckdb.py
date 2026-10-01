from db.duckdb_manager import DuckDBManager
db = DuckDBManager()
df = db.query_tables(source="sys_hf_26.pdf")
print(len(df), "tables")
print(df[["table_caption", "page"]])