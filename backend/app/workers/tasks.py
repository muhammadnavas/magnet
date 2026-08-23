import asyncio

async def process_document(ctx, knowledge_id: str):
    # Process document placeholder. In Phase 2 this will read, chunk, and embed documents.
    print(f"Starting background job process_document for knowledge item {knowledge_id}")
    await asyncio.sleep(2)
    print(f"Finished job process_document for {knowledge_id}")
    return {"status": "completed", "item_id": knowledge_id}
