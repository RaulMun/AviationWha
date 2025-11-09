import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import prisma from './prisma.js'

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-in-production'

export async function registerUser({ username, password }) {
  if (!username || !password) {
    const err = new Error('username and password required')
    err.status = 400
    throw err
  }
  // check existing user
  const existing = await prisma.user.findUnique({ where: { username } })
  if (existing) {
    const err = new Error('Username taken')
    err.status = 409
    throw err
  }

  const hash = await bcrypt.hash(password, 10)
  const user = await prisma.user.create({ data: { username, password: hash } })

  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '1h' })
  return { user, token }
}

export async function loginUser({ username, password }) {
  if (!username || !password) {
    const err = new Error('username and password required')
    err.status = 400
    throw err
  }

  const user = await prisma.user.findUnique({ where: { username } })
  if (!user) {
    const err = new Error('Invalid credentials')
    err.status = 401
    throw err
  }

  const match = await bcrypt.compare(password, user.password)
  if (!match) {
    const err = new Error('Invalid credentials')
    err.status = 401
    throw err
  }

  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '1h' })
  return { user, token }
}