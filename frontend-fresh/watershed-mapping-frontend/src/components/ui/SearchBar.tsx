import React, { useState, useEffect, useRef } from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '../../lib/utils'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  onSearch?: (value: string) => void
  placeholder?: string
  className?: string
  suggestions?: string[]
  onSuggestionClick?: (suggestion: string) => void
  loading?: boolean
  clearable?: boolean
  debounceMs?: number
}

const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  onSearch,
  placeholder = 'Search...',
  className,
  suggestions = [],
  onSuggestionClick,
  loading = false,
  clearable = true,
  debounceMs = 300,
}) => {
  const [isSuggestionsVisible, setIsSuggestionsVisible] = useState(false)
  const [debouncedValue, setDebouncedValue] = useState(value)
  const searchRef = useRef<HTMLDivElement>(null)

  // Debounce the search value
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value)
    }, debounceMs)

    return () => clearTimeout(timer)
  }, [value, debounceMs])

  // Call onSearch with debounced value
  useEffect(() => {
    if (onSearch) {
      onSearch(debouncedValue)
    }
  }, [debouncedValue, onSearch])

  // Hide suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSuggestionsVisible(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    onChange(newValue)
    setIsSuggestionsVisible(true)
  }

  const handleSuggestionClick = (suggestion: string) => {
    onChange(suggestion)
    setIsSuggestionsVisible(false)
    if (onSuggestionClick) {
      onSuggestionClick(suggestion)
    }
    if (onSearch) {
      onSearch(suggestion)
    }
  }

  const handleClear = () => {
    onChange('')
    setIsSuggestionsVisible(false)
    if (onSearch) {
      onSearch('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setIsSuggestionsVisible(false)
    } else if (e.key === 'Enter') {
      if (onSearch) {
        onSearch(value)
      }
      setIsSuggestionsVisible(false)
    }
  }

  const hasSuggestions = suggestions.length > 0 && isSuggestionsVisible

  return (
    <div ref={searchRef} className={cn('relative', className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsSuggestionsVisible(true)}
          placeholder={placeholder}
          className={cn(
            'w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg',
            'focus:ring-2 focus:ring-blue-500 focus:border-transparent',
            'transition-all duration-200',
            loading && 'bg-gray-50 cursor-not-allowed',
            'text-sm'
          )}
          disabled={loading}
        />
        {clearable && value && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {loading && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin h-4 w-4 border-2 border-gray-300 border-t-blue-600 rounded-full"></div>
          </div>
        )}
      </div>

      {/* Suggestions dropdown */}
      {hasSuggestions && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              onClick={() => handleSuggestionClick(suggestion)}
              className={cn(
                'w-full px-4 py-2 text-left text-sm',
                'hover:bg-gray-100 transition-colors duration-150',
                'border-b border-gray-100 last:border-b-0',
                index === 0 && 'rounded-t-lg',
                index === suggestions.length - 1 && 'rounded-b-lg'
              )}
            >
              <div className="flex items-center">
                <Search className="h-4 w-4 text-gray-400 mr-3 flex-shrink-0" />
                <span className="truncate">{suggestion}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default SearchBar