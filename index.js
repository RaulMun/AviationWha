import express from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import dotenv from 'dotenv'
import { PrismaClient } from '@prisma/client'
import { authenticateToken } from './middleware/auth.middleware.js'

dotenv.config()

const app = express()
app.use(express.json())

const prisma = new PrismaClient()
const JWT_SECRET = process.env.JWT_SECRET

// POST /register
// body: { username, password }
app.post('/register', async (req, res) => {
  const { username, password } = req.body
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' })
  }

  try {
    const existing = await prisma.user.findUnique({ where: { username } })
    if (existing) return res.status(409).json({ message: 'Username already taken' })

    const passwordHash = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: { username, password: passwordHash }
    })

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '1h' })
    return res.status(201).json({ message: 'User registered', token })
  } catch (err) {
    console.error('Register error:', err)
    return res.status(500).json({ message: 'Internal server error' })
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
