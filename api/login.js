import { loginUser } from '../lib/authService'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ message: 'Method not allowed' })
  }
  
  try {
    const { user, token } = await loginUser(req.body || {})
    return res.status(200).json({ token })
  } catch (err) {
    console.error('login handler error:', err)
    return res.status(err.status || 500).json({ message: err.message || 'Internal server error' })
  }
}