import React from 'react';
import styles from './FilterBar.module.css';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Search } from 'lucide-react';

interface FilterBarProps {
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  typeFilter: string;
  setTypeFilter: (val: string) => void;
  sideFilter: string;
  setSideFilter: (val: string) => void;
}

export function FilterBar({
  searchQuery,
  setSearchQuery,
  typeFilter,
  setTypeFilter,
  sideFilter,
  setSideFilter
}: FilterBarProps) {
  return (
    <div className={styles.container}>
      <div className={styles.searchWrapper}>
        <Search className={styles.searchIcon} />
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Search symbol..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>
      
      <div className={styles.filters}>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className={styles.select}>
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="market">Market Liq</SelectItem>
            <SelectItem value="backstop">Backstop</SelectItem>
            <SelectItem value="settlement">Settlement</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sideFilter} onValueChange={setSideFilter}>
          <SelectTrigger className={styles.select}>
            <SelectValue placeholder="All Sides" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sides</SelectItem>
            <SelectItem value="long">Longs Only</SelectItem>
            <SelectItem value="short">Shorts Only</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
