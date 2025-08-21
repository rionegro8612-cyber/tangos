'use client';
import { useState } from 'react';
import LocationAutocomplete from './LocationAutocomplete';
import LocationAutocompleteV2 from './LocationAutocompleteV2';

// 기존과 새로운 컴포넌트의 타입을 통합
interface LocationItem {
  label?: string;
  name?: string;
  code?: string | null;
  regionCode?: string;
  lat: number | null;
  lng: number | null;
  source: "kakao" | "vworld" | "local";
}

interface LocationAutocompleteWrapperProps {
  onSelect: (item: LocationItem) => void;
  placeholder?: string;
  className?: string;
  useNewVersion?: boolean; // 새로운 버전 사용 여부
}

export default function LocationAutocompleteWrapper({
  onSelect,
  placeholder = "지역을 입력하세요...",
  className = "",
  useNewVersion = true // 기본적으로 새로운 버전 사용
}: LocationAutocompleteWrapperProps) {
  const [selectedLocation, setSelectedLocation] = useState<LocationItem | null>(null);

  // 새로운 버전 사용 시
  if (useNewVersion) {
    return (
      <LocationAutocompleteV2
        value={selectedLocation ? {
          name: selectedLocation.name || selectedLocation.label || '',
          lat: selectedLocation.lat || 0,
          lng: selectedLocation.lng || 0,
          regionCode: selectedLocation.regionCode || selectedLocation.code || undefined
        } : undefined}
        onSelect={(item) => {
          const locationItem: LocationItem = {
            name: item.name,
            label: item.name,
            code: item.regionCode || null,
            regionCode: item.regionCode,
            lat: item.lat,
            lng: item.lng,
            source: item.source
          };
          setSelectedLocation(locationItem);
          onSelect(locationItem);
        }}
        placeholder={placeholder}
        className={className}
      />
    );
  }

  // 기존 버전 사용 시
  return (
    <LocationAutocomplete
      onSelect={(item) => {
        const locationItem: LocationItem = {
          label: item.label,
          name: item.label,
          code: item.code,
          regionCode: item.code,
          lat: item.lat,
          lng: item.lng,
          source: item.source
        };
        setSelectedLocation(locationItem);
        onSelect(locationItem);
      }}
      placeholder={placeholder}
      className={className}
    />
  );
}
