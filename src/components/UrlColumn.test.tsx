import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { UrlColumn } from './UrlColumn'

describe('UrlColumn', () => {
    it('renders placeholder for empty value', () => {
        render(<UrlColumn value={null} />)
        expect(screen.getByText('-')).toBeInTheDocument()
    })

    it('renders custom placeholder', () => {
        render(<UrlColumn value={null} placeholder="No URL" />)
        expect(screen.getByText('No URL')).toBeInTheDocument()
    })

    it('renders URL without protocol', () => {
        render(<UrlColumn value="https://example.com/path" />)
        expect(screen.getByText('example.com/path')).toBeInTheDocument()
    })

    it('removes http:// protocol as well', () => {
        render(<UrlColumn value="http://example.com" />)
        expect(screen.getByText('example.com')).toBeInTheDocument()
    })

    it('truncates long URLs to maxLength', () => {
        const longUrl = 'https://example.com/very/long/path/that/exceeds/max/length'
        render(<UrlColumn value={longUrl} maxLength={20} />)
        // Should show first 20 chars + "..."
        expect(screen.getByText('example.com/very/lon...')).toBeInTheDocument()
    })

    it('uses default maxLength of 25', () => {
        const url = 'https://example.com/path/that/is/longer/than/25'
        render(<UrlColumn value={url} />)
        // example.com/path/that/is/longer/than/25 = 38 chars
        // Truncated to 25 + "..."
        expect(screen.getByText('example.com/path/that/is/...')).toBeInTheDocument()
    })

    it('does not truncate short URLs', () => {
        render(<UrlColumn value="https://x.com/test" />)
        expect(screen.getByText('x.com/test')).toBeInTheDocument()
    })

    it('renders external link icon', () => {
        render(<UrlColumn value="https://example.com" />)
        const link = screen.getByTitle('Open URL')
        expect(link).toBeInTheDocument()
        expect(link).toHaveAttribute('href', 'https://example.com')
        expect(link).toHaveAttribute('target', '_blank')
        expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    })

    it('returns null when isEditing is true', () => {
        const { container } = render(<UrlColumn value="https://example.com" isEditing={true} />)
        expect(container.firstChild).toBeNull()
    })

    it('renders normally when isEditing is false', () => {
        render(<UrlColumn value="https://example.com" isEditing={false} />)
        expect(screen.getByText('example.com')).toBeInTheDocument()
    })

    it('shows full URL in title attribute for tooltip', () => {
        const fullUrl = 'https://example.com/very/long/path'
        render(<UrlColumn value={fullUrl} maxLength={10} />)
        const span = screen.getByTitle(fullUrl)
        expect(span).toBeInTheDocument()
    })

    it('handles URL without path', () => {
        render(<UrlColumn value="https://example.com" />)
        expect(screen.getByText('example.com')).toBeInTheDocument()
    })

    it('handles empty string value', () => {
        render(<UrlColumn value="" />)
        expect(screen.getByText('-')).toBeInTheDocument()
    })
})
