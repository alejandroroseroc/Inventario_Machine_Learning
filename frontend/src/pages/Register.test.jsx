import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import Register from './register'

function setup() {
  render(<BrowserRouter><Register /></BrowserRouter>)
}

describe('Register page', () => {
  it('deshabilita el botón hasta que la forma sea válida', () => {
    setup()
    const btn = screen.getByRole('button', { name:/registrarme/i })
    expect(btn).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/correo/i), { target:{ value:'a@a.com' } })
    fireEvent.change(screen.getByLabelText(/^contraseña$/i), { target:{ value:'Demo1234!' } })
    fireEvent.change(screen.getByLabelText(/confirmar contraseña/i), { target:{ value:'Demo1234!' } })

    expect(btn).not.toBeDisabled()
  })
})
