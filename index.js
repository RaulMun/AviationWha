import express from 'express'
import dotenv from 'dotenv'
import { authenticateToken } from './middleware/auth.middleware.js'
import { registerUser, loginUser } from './lib/authService.js'
import prisma from './lib/prisma.js'

dotenv.config()

const app = express()
app.use(express.json())

// POST /register
// body: { username, password }
app.post('/register', async (req, res) => {
  try {
    const { user, token } = await registerUser(req.body || {})
    return res.status(201).json({ message: 'User registered', token })
  } catch (err) {
    console.error('Register error:', err)
    return res.status(err.status || 500).json({ message: err.message || 'Internal server error' })
  }
})


// POST /login
// body: { username, password }
app.post('/login', async (req, res) => {
  try {
    const { user, token } = await loginUser(req.body || {})
    return res.json({ token })
  } catch (err) {
    console.error('Login error:', err)
    return res.status(err.status || 500).json({ message: err.message || 'Internal server error' })
  }
})

// GET /me - protected route that fetches next flights for an airport from AviationStack
// Query params: iata (required), type=arrivals|departures (optional, default=arrivals), limit (optional)
app.get('/me', authenticateToken, async (req, res) => {
  const iata = (req.query.iata || '').toUpperCase()
  const type = (req.query.type || 'arrivals').toLowerCase()
  const limit = 5

  if (!iata) return res.status(400).json({ message: 'iata query parameter required' })
  if (!['arrivals', 'departures'].includes(type)) return res.status(400).json({ message: "type must be 'arrivals' or 'departures'" })

  const AVIATIONSTACK_KEY = process.env.AVIATIONSTACK_API_KEY
  if (!AVIATIONSTACK_KEY) return res.status(500).json({ message: 'AviationStack API key not configured' })

  // confirm fetch is available
  const fetchFn = global.fetch
  if (!fetchFn) {
    console.error('global.fetch is not available in this runtime. Install node-fetch or use Node 18+')
    return res.status(500).json({ message: 'Fetch not available in runtime; install node-fetch or use Node >= 18' })
  }

  const param = type === 'arrivals' ? 'arr_iata' : 'dep_iata'
  const url = `https://api.aviationstack.com/v1/flights?access_key=${encodeURIComponent(AVIATIONSTACK_KEY)}&${param}=${encodeURIComponent(iata)}&limit=100`

  try {
    const resp = await fetchFn(url)
    if (!resp.ok) {
      const text = await resp.text()
      console.error('AviationStack error:', resp.status, text)
      return res.status(502).json({ message: 'Upstream service error', status: resp.status })
    }

    const body = await resp.json()
    const now = Date.now()

    const normalized = (body.data || []).map(f => {
      const departure = f.departure || {}
      const arrival = f.arrival || {}
      const scheduled = type === 'arrivals' ? arrival.scheduled : departure.scheduled
      const estimated = type === 'arrivals' ? arrival.estimated : departure.estimated
      const timeStr = estimated || scheduled
      const timeMs = timeStr ? Date.parse(timeStr) : null

      return {
        flight_iata: f.flight?.iata || null,
        flight_number: f.flight?.number || null,
        airline: f.airline?.name || null,
        origin: { iata: departure.iata || null, icao: departure.icao || null, terminal: departure.terminal || null, gate: departure.gate || null },
        destination: { iata: arrival.iata || null, icao: arrival.icao || null, terminal: arrival.terminal || null, gate: arrival.gate || null },
        scheduled: scheduled || null,
        estimated: estimated || null,
        timeMs,
        status: f.flight_status || null,
      }
    })

    const upcoming = normalized
      .filter(f => f.timeMs && f.timeMs >= now)
      .sort((a, b) => a.timeMs - b.timeMs)
      .slice(0, limit)
      .map(f => {
        const { timeMs, ...rest } = f
        return rest
      })

    return res.json({ airport: iata, type, count: upcoming.length, flights: upcoming })
  } catch (err) {
    console.error('Error fetching aviation data:', err)
    return res.status(500).json({ message: 'Failed to fetch aviation data' })
  }
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`))
