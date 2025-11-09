import { registerUser } from '../lib/authService.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const { user, token } = await registerUser(req.body || {})
    return res.status(201).json({ token })
  } catch (err) {
    console.error('register handler error:', err)
    return res.status(err.status || 500).json({ message: err.message || 'Internal server error' })
  }
}