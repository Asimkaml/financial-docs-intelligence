import duckdb

conn = duckdb.connect("duckdb/filings.duckdb")

print(conn.execute("SHOW TABLES").fetchall())
# conn.execute("DROP TABLE IF EXISTS filing_tables")
print(
    conn.execute("SELECT * FROM document_pages LIMIT 10").fetchdf()
)

# print(
#     conn.execute("DESCRIBE filing_tables").fetchdf()
# )   
