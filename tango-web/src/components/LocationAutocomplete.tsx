"use client";

import { useState, useEffect, useRef } from "react";
import { api } from "@/src/lib/api";

interface LocationItem {
  label: string;
  code: string | null;
  lat: number | null;
  lng: number | null;
  source: "kakao" | "vworld" | "local";
}

interface LocationAutocompleteProps {
  onSelect: (item: LocationItem) => void;
  placeholder?: string;
  className?: string;
}

export default function LocationAutocomplete({ 
  onSelect, 
  placeholder = "지역을 입력하세요...",
  className = ""
}: LocationAutocompleteProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LocationItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 검색 디바운싱
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      if (query.trim().length < 2) return;
      
      setIsLoading(true);
      try {
        const response = await api<{ items: LocationItem[] }>(`/location/search?q=${encodeURIComponent(query.trim())}`);
        setResults(response.data.items);
        setShowDropdown(true);
        setSelectedIndex(-1);
      } catch (error) {
        console.error("위치 검색 오류:", error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current && 
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 키보드 네비게이션
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || results.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < results.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0) {
          handleSelect(results[selectedIndex]);
        }
        break;
      case "Escape":
        setShowDropdown(false);
        setSelectedIndex(-1);
        break;
    }
  };

  const handleSelect = (item: LocationItem) => {
    setQuery(item.label);
    setShowDropdown(false);
    setSelectedIndex(-1);
    onSelect(item);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setShowDropdown(true);
  };

  const handleInputFocus = () => {
    if (query.trim() && results.length > 0) {
      setShowDropdown(true);
    }
  };

  return (
    <div className={`relative ${className}`}>
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={handleInputChange}
        onFocus={handleInputFocus}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        autoComplete="off"
      />
      
      {isLoading && (
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
        </div>
      )}

      {showDropdown && results.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto"
        >
          {results.map((item, index) => (
            <div
              key={`${item.label}-${index}`}
              className={`px-3 py-2 cursor-pointer hover:bg-gray-100 ${
                index === selectedIndex ? "bg-blue-100" : ""
              }`}
              onClick={() => handleSelect(item)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <div className="font-medium">{item.label}</div>
              <div className="text-sm text-gray-500">
                {item.code && `코드: ${item.code}`}
                {item.lat && item.lng && ` • 좌표: ${item.lat.toFixed(3)}, ${item.lng.toFixed(3)}`}
                {` • 소스: ${item.source}`}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
