import React, { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MagnifyingGlassIcon,
  XMarkIcon,
  MapIcon,
  BeakerIcon,
  ChartBarIcon,
  ClockIcon,
} from '@heroicons/react/24/outline'
import { useSelector, useDispatch } from 'react-redux'
import { addSearchHistory } from '../../store/slices/uiSlice'
import mapService from '../../services/mapService'
import watershedService from '../../services/watershedService'

const SearchBar = () => {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [recentSearches, setRecentSearches] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  
  const inputRef = useRef(null)
  const searchTimeoutRef = useRef(null)

  // Get recent searches from store (you'll need to implement this selector)
  const searchHistory = useSelector((state) => state.ui.searchHistory)

  useEffect(() => {
    setRecentSearches(searchHistory.slice(0, 5))
  }, [searchHistory])

  // Handle input change with debouncing
  const handleInputChange = (e) => {
    const value = e.target.value
    setQuery(value)
    setSelectedIndex(-1)

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    if (value.trim().length > 2) {
      // Debounce search
      searchTimeoutRef.current = setTimeout(() => {
        performSearch(value)
      }, 300)
    } else {
      setResults([])
    }
  }

  // Perform search
  const performSearch = async (searchQuery) => {
    setLoading(true)
    try {
      // Search watersheds
      const watershedResults = await watershedService.searchWatersheds(searchQuery, {
        limit: 5,
      })

      // Geocoding search
      const geocodingResults = await mapService.getGeocoding(searchQuery)

      // Combine and format results
      const combinedResults = [
        ...watershedResults.results.map((item) => ({
          type: 'watershed',
          title: item.name,
          subtitle: `Watershed • ${item.area?.toFixed(2)} km²`,
          icon: BeakerIcon,
          href: `/watersheds/${item.id}`,
          data: item,
        })),
        ...geocodingResults.results.map((item) => ({
          type: 'location',
          title: item.name,
          subtitle: item.type,
          icon: MapIcon,
          href: `/map?lat=${item.lat}&lng=${item.lng}&zoom=10`,
          data: item,
        })),
      ]

      setResults(combinedResults.slice(0, 8))
    } catch (error) {
      console.error('Search error:', error)
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (!isOpen) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex((prev) => Math.min(prev + 1, results.length + recentSearches.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex((prev) => Math.max(prev - 1, -1))
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0) {
          handleResultClick(getItems()[selectedIndex])
        } else if (query.trim()) {
          handleSubmit(query)
        }
        break
      case 'Escape':
        setIsOpen(false)
        setQuery('')
        setResults([])
        break
    }
  }

  // Get all items (results + recent searches)
  const getItems = () => {
    const recentItems = recentSearches.map((item) => ({
      type: 'recent',
      title: item,
      subtitle: 'Recent search',
      icon: ClockIcon,
      href: `/search?q=${encodeURIComponent(item)}`,
      data: { query: item },
    }))

    return [...results, ...recentItems]
  }

  // Handle result click
  const handleResultClick = (item) => {
    setQuery('')
    setResults([])
    setIsOpen(false)
    setSelectedIndex(-1)

    // Add to search history
    if (item.type !== 'recent') {
      dispatch(addSearchHistory(query))
    }

    // Navigate to result
    navigate(item.href)
  }

  // Handle form submission
  const handleSubmit = (searchQuery) => {
    if (!searchQuery.trim()) return

    // Add to search history
    dispatch(addSearchHistory(searchQuery))

    // Navigate to search results
    navigate(`/search?q=${encodeURIComponent(searchQuery)}`)
    setIsOpen(false)
    setQuery('')
    setResults([])
  }

  // Handle recent search click
  const handleRecentClick = (query) => {
    setQuery(query)
    handleSubmit(query)
  }

  // Clear search
  const clearSearch = () => {
    setQuery('')
    setResults([])
    setIsOpen(false)
    inputRef.current?.focus()
  }

  return (
    <div className="relative">
      {/* Search input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsOpen(true)}
          className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
          placeholder="Search watersheds, locations, or analyses..."
        />
        {query && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
            <button
              onClick={clearSearch}
              className="text-gray-400 hover:text-gray-600"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>

      {/* Search results dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute z-50 w-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 max-h-96 overflow-hidden"
          >
            {/* Loading state */}
            {loading && (
              <div className="p-4 text-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500 mx-auto"></div>
                <p className="text-sm text-gray-500 mt-2">Searching...</p>
              </div>
            )}

            {/* Results */}
            {!loading && (
              <>
                {getItems().length === 0 && query.length > 2 ? (
                  <div className="p-4 text-center text-gray-500">
                    <MagnifyingGlassIcon className="mx-auto h-8 w-8 text-gray-400" />
                    <p className="mt-2 text-sm">No results found for "{query}"</p>
                  </div>
                ) : (
                  <div className="py-1 max-h-64 overflow-y-auto">
                    {getItems().map((item, index) => (
                      <button
                        key={index}
                        onClick={() => item.type === 'recent' 
                          ? handleRecentClick(item.title) 
                          : handleResultClick(item)}
                        className={`w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center space-x-3 ${
                          index === selectedIndex ? 'bg-primary-50' : ''
                        }`}
                      >
                        <item.icon className="h-5 w-5 text-gray-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {item.title}
                          </p>
                          {item.subtitle && (
                            <p className="text-xs text-gray-500 truncate">
                              {item.subtitle}
                            </p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Search button for custom queries */}
                {query.trim() && (
                  <div className="border-t border-gray-200 p-3">
                    <button
                      onClick={() => handleSubmit(query)}
                      className="w-full text-left px-4 py-2 text-sm text-primary-600 hover:bg-primary-50 rounded flex items-center space-x-2"
                    >
                      <MagnifyingGlassIcon className="h-4 w-4" />
                      <span>Search for "{query}"</span>
                    </button>
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Overlay to close dropdown */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  )
}

export default SearchBar