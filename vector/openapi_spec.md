# LLM Cache API - OpenAPI Specification

```yaml
openapi: 3.0.3
info:
  title: LLM Cache API
  description: A semantic caching system for LLM prompts using vector similarity search
  version: 1.0.0
  contact:
    name: API Support

servers:
  - url: https://your-worker.workers.dev
    description: Production server

paths:
  /upsert:
    post:
      summary: Store a prompt and its response
      description: |
        Generates a vector representation of the prompt, stores it in the vector database,
        and caches the full request data for later retrieval.
      operationId: upsertPrompt
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - prompt
              properties:
                prompt:
                  type: string
                  description: The prompt text to cache (must contain at least one letter)
                  example: "How do I bake a chocolate cake?"
                response:
                  type: string
                  description: The LLM response to cache (optional, caller-defined)
                  example: "To bake a chocolate cake, you'll need..."
                metadata:
                  type: object
                  description: Any additional metadata to store with the prompt
                  additionalProperties: true
            examples:
              basic:
                value:
                  prompt: "What is the capital of France?"
                  response: "The capital of France is Paris."
              with_metadata:
                value:
                  prompt: "Explain quantum entanglement"
                  response: "Quantum entanglement is a physical phenomenon..."
                  metadata:
                    model: "gpt-4"
                    timestamp: "2025-11-08T10:30:00Z"
      responses:
        '204':
          description: Successfully stored prompt and vector
        '400':
          description: Invalid request - prompt must contain at least one letter
          content:
            text/plain:
              schema:
                type: string
                example: "Bad Request"

  /query:
    post:
      summary: Find a similar cached prompt
      description: |
        Searches the vector database for the most similar cached prompt.
        Returns the cached data if a match is found. The caller should compare
        the returned prompt with the query prompt to determine if the match
        is acceptable.
      operationId: queryPrompt
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - prompt
              properties:
                prompt:
                  type: string
                  description: The prompt to search for (must contain at least one letter)
                  example: "How do I make a chocolate cake?"
            examples:
              basic:
                value:
                  prompt: "What's the capital of France?"
      responses:
        '200':
          description: Found a similar cached prompt
          headers:
            X-Match-Score:
              schema:
                type: number
                format: float
              description: Similarity score of the match (0-1)
              example: 0.87
          content:
            application/json:
              schema:
                type: object
                description: The original cached data from the upsert request
                properties:
                  prompt:
                    type: string
                    example: "What is the capital of France?"
                  response:
                    type: string
                    example: "The capital of France is Paris."
                  metadata:
                    type: object
                    additionalProperties: true
              examples:
                match_found:
                  value:
                    prompt: "What is the capital of France?"
                    response: "The capital of France is Paris."
                    metadata:
                      model: "gpt-4"
                      timestamp: "2025-11-08T10:30:00Z"
        '400':
          description: Invalid request - prompt must contain at least one letter
          content:
            text/plain:
              schema:
                type: string
                example: "Bad Request"
        '404':
          description: No similar prompt found in cache
          content:
            text/plain:
              schema:
                type: string
                example: "Not Found"

components:
  schemas:
    Error:
      type: object
      properties:
        error:
          type: string
          description: Error message
        code:
          type: integer
          description: HTTP status code

tags:
  - name: Cache
    description: Vector-based semantic cache operations
```

## Usage Notes

### Workflow
1. **First request**: Call `/upsert` with prompt and response to cache them
2. **Subsequent requests**: Call `/query` with a new prompt to find similar cached prompts
3. **Compare prompts**: Check if the returned prompt is similar enough to use the cached response
4. **Fallback**: If no match or similarity too low, generate a new response and upsert it

### Similarity Comparison
The API returns the exact cached data. Your caller should:
- Compare the returned `prompt` with the query `prompt`
- Use string similarity (Levenshtein, cosine, etc.) or manual review
- Check the `X-Match-Score` header if you add it to determine match quality
- Decide whether to use the cached response or generate a new one

### Vector Encoding
Prompts are encoded using:
- Word frequencies from a 232-word vocabulary
- Prefix matching for word variations
- Top 20% bigrams from remaining text
- Character frequencies
- L2 normalization for comparison
