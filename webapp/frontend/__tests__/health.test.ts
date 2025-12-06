/**
 * @jest-environment node
 */

// Test health check API route
describe('Health Check API', () => {
  it('should export GET method', async () => {
    const { GET } = await import('../app/api/health/route')
    expect(GET).toBeDefined()
    expect(typeof GET).toBe('function')
  })

  it('should return healthy status', async () => {
    const { GET } = await import('../app/api/health/route')
    const response = await GET()
    const data = await response.json()
    
    expect(data.status).toBe('healthy')
    expect(data.service).toBe('Smart Investment AI Frontend')
  })
})
