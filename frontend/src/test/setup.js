// Activa automáticamente los matchers (toBeDisabled, toBeInTheDocument, etc.)
import '@testing-library/jest-dom/vitest'

// Limpieza del DOM después de cada test
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
afterEach(() => cleanup())
