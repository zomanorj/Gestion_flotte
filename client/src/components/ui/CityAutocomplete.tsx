import { useState, useEffect, useRef } from 'react'
import { searchVilles } from '../../services/geoService'
import type { Ville } from '../../services/geoService'

interface CityAutocompleteProps {
  label: string
  placeholder?: string
  value: string
  onSelect: (ville: Ville) => void
  onChange?: (value: string) => void
  error?: string
  disabled?: boolean
}

export default function CityAutocomplete({
  label,
  placeholder = 'Rechercher une ville...',
  value,
  onSelect,
  onChange,
  error,
  disabled = false,
}: CityAutocompleteProps) {
  const [query, setQuery] = useState(value)
  const [suggestions, setSuggestions] = useState<Ville[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  
  const containerRef = useRef<HTMLDivElement>(null)

  // Mettre à jour query si la valeur externe change
  useEffect(() => {
    setQuery(value)
  }, [value])

  // Debounce pour la recherche
  useEffect(() => {
    if (!isOpen || query.length < 2) {
      setSuggestions([])
      return
    }

    // Délai réduit à 300ms pour des suggestions plus réactives dès 2 caractères
    const timer = setTimeout(async () => {
      setIsLoading(true)
      const results = await searchVilles(query)
      setSuggestions(results)
      setIsLoading(false)
      setSelectedIndex(-1)
    }, 300)

    return () => clearTimeout(timer)
  }, [query, isOpen])

  // Fermer au clic extérieur
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)
    if (onChange) onChange(val)
    setIsOpen(true)
  }

  const handleSelect = (ville: Ville) => {
    setQuery(ville.nom)
    if (onChange) onChange(ville.nom)
    onSelect(ville)
    setIsOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1))
    } else if (e.key === 'Enter' && selectedIndex >= 0 && selectedIndex < suggestions.length) {
      e.preventDefault()
      handleSelect(suggestions[selectedIndex])
    } else if (e.key === 'Escape') {
      setIsOpen(false)
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <label className="block text-xs font-medium text-slate-600 mb-1">
        {label} <span className="text-red-500">*</span>
      </label>
      
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
            error ? 'border-red-500' : 'border-slate-300'
          } ${disabled ? 'bg-slate-50 text-slate-500' : 'bg-white'}`}
        />
        
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <svg className="w-4 h-4 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
        )}
      </div>

      {isOpen && query.length >= 2 && !isLoading && (
        <ul className="absolute z-[100] w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto overflow-x-hidden">
          {suggestions.length === 0 ? (
            <li className="px-4 py-3 text-sm text-slate-500 text-center">
              Aucun résultat trouvé.
            </li>
          ) : (
            suggestions.map((ville, index) => (
              <li
                key={`${ville.lat}-${ville.lng}-${index}`}
                onClick={() => handleSelect(ville)}
                className={`px-4 py-2 cursor-pointer transition-colors ${
                  index === selectedIndex ? 'bg-blue-100' : 'hover:bg-blue-50'
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5">📍</span>
                  <div>
                    <div className="font-semibold text-slate-800 text-sm">{ville.nom}</div>
                    <div className="text-xs text-slate-500 truncate max-w-full">{ville.affichage}</div>
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
