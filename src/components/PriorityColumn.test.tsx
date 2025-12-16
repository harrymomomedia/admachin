import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PriorityColumn } from './PriorityColumn'

describe('PriorityColumn', () => {
    it('renders the value correctly', () => {
        render(<PriorityColumn value={3} />)
        expect(screen.getByText('3')).toBeInTheDocument()
    })

    it('renders placeholder for empty value', () => {
        render(<PriorityColumn value={null} />)
        expect(screen.getByText('-')).toBeInTheDocument()
    })

    it('renders placeholder for zero value', () => {
        render(<PriorityColumn value={0} />)
        // Zero is falsy, so it shows the value (String(0) = "0") but check the logic
        expect(screen.getByText('-')).toBeInTheDocument()
    })

    it('applies red color for high priority (4-5 out of 5)', () => {
        const { container } = render(<PriorityColumn value={5} />)
        const span = container.querySelector('span')
        expect(span).toHaveClass('text-red-600')
    })

    it('applies red color for priority at high threshold', () => {
        const { container } = render(<PriorityColumn value={4} />)
        const span = container.querySelector('span')
        expect(span).toHaveClass('text-red-600')
    })

    it('applies orange color for medium priority (2-3 out of 5)', () => {
        const { container } = render(<PriorityColumn value={3} />)
        const span = container.querySelector('span')
        expect(span).toHaveClass('text-orange-500')
    })

    it('applies orange color for priority at medium threshold', () => {
        const { container } = render(<PriorityColumn value={2} />)
        const span = container.querySelector('span')
        expect(span).toHaveClass('text-orange-500')
    })

    it('applies gray color for low priority (1 out of 5)', () => {
        const { container } = render(<PriorityColumn value={1} />)
        const span = container.querySelector('span')
        expect(span).toHaveClass('text-gray-600')
    })

    it('respects custom maxPriority', () => {
        // With maxPriority=10:
        // High threshold: ceil(10 * 0.8) = 8
        // Medium threshold: ceil(10 * 0.4) = 4
        const { container: high } = render(<PriorityColumn value={9} maxPriority={10} />)
        expect(high.querySelector('span')).toHaveClass('text-red-600')

        const { container: medium } = render(<PriorityColumn value={5} maxPriority={10} />)
        expect(medium.querySelector('span')).toHaveClass('text-orange-500')

        const { container: low } = render(<PriorityColumn value={2} maxPriority={10} />)
        expect(low.querySelector('span')).toHaveClass('text-gray-600')
    })

    it('handles string numeric values', () => {
        render(<PriorityColumn value="4" />)
        expect(screen.getByText('4')).toBeInTheDocument()
    })

    it('handles non-numeric strings gracefully', () => {
        const { container } = render(<PriorityColumn value="high" />)
        expect(screen.getByText('high')).toBeInTheDocument()
        // NaN becomes 0, which is low priority
        expect(container.querySelector('span')).toHaveClass('text-gray-600')
    })
})
