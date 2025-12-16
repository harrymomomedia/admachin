import { describe, it, expect } from 'vitest'
import { cn } from './cn'

describe('cn utility', () => {
    it('should merge simple class names', () => {
        expect(cn('foo', 'bar')).toBe('foo bar')
    })

    it('should handle conditional classes', () => {
        expect(cn('base', true && 'included', false && 'excluded')).toBe('base included')
    })

    it('should handle undefined and null values', () => {
        expect(cn('foo', undefined, null, 'bar')).toBe('foo bar')
    })

    it('should handle empty strings', () => {
        expect(cn('foo', '', 'bar')).toBe('foo bar')
    })

    it('should merge conflicting Tailwind classes correctly', () => {
        // tailwind-merge should keep the last conflicting class
        expect(cn('px-2', 'px-4')).toBe('px-4')
        expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500')
    })

    it('should handle arrays of classes', () => {
        expect(cn(['foo', 'bar'], 'baz')).toBe('foo bar baz')
    })

    it('should handle object notation', () => {
        expect(cn({ foo: true, bar: false, baz: true })).toBe('foo baz')
    })

    it('should handle complex combinations', () => {
        const result = cn(
            'base-class',
            { conditional: true },
            ['array', 'classes'],
            undefined,
            'final'
        )
        expect(result).toBe('base-class conditional array classes final')
    })

    it('should return empty string for no input', () => {
        expect(cn()).toBe('')
    })

    it('should handle Tailwind responsive prefixes correctly', () => {
        expect(cn('md:px-2', 'md:px-4')).toBe('md:px-4')
    })

    it('should preserve non-conflicting classes', () => {
        expect(cn('px-2 py-4', 'mx-2')).toBe('px-2 py-4 mx-2')
    })
})
