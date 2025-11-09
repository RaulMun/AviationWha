import express from 'express'
import dotenv from 'dotenv'
import { authenticateToken } from './middleware/auth.middleware.js'
import { registerUser } from './lib/authService.js'
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

// example protected route
app.get('/profile', authenticateToken, async (req, res) => {
  const payload = req.user
  if (!payload || !payload.username) return res.status(400).json({ message: 'Invalid token payload' })

  try {
    const user = await prisma.user.findUnique({ where: { username: payload.username }, select: { id: true, username: true } })
    if (!user) return res.status(404).json({ message: 'User not found' })
    return res.json({ user })
  } catch (err) {
    console.error('Profile error:', err)
    return res.status(500).json({ message: 'Internal server error' })
  }
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`))
