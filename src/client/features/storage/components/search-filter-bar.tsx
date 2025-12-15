"use client";

import {
    Box,
    Button,
    Chip,
    FormControl,
    IconButton,
    InputAdornment,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    Stack,
    TextField,
    Tooltip,
    Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import SortIcon from "@mui/icons-material/Sort";
import FilterListIcon from "@mui/icons-material/FilterList";

interface SearchFilterBarProps {
    searchQuery: string;
    onSearchChange: (query: string) => void;
    fileType: string;
    onFileTypeChange: (type: string) => void;
    sortBy: 'name' | 'size' | 'date';
    onSortByChange: (sortBy: 'name' | 'size' | 'date') => void;
    sortOrder: 'asc' | 'desc';
    onSortOrderChange: (order: 'asc' | 'desc') => void;
    onClearFilters: () => void;
    hasActiveFilters: boolean;
}

const FILE_TYPES = [
    { value: 'all', label: 'All Types' },
    { value: 'folder', label: 'Folders' },
    { value: 'image', label: 'Images' },
    { value: 'document', label: 'Documents' },
    { value: 'code', label: 'Code Files' },
    { value: 'archive', label: 'Archives' },
];

const SORT_OPTIONS = [
    { value: 'name', label: 'Name' },
    { value: 'size', label: 'Size' },
    { value: 'date', label: 'Date Modified' },
];

export default function SearchFilterBar({
    searchQuery,
    onSearchChange,
    fileType,
    onFileTypeChange,
    sortBy,
    onSortByChange,
    sortOrder,
    onSortOrderChange,
    onClearFilters,
    hasActiveFilters,
}: SearchFilterBarProps) {
    return (
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Stack spacing={2}>
                {/* Search and Filter Row */}
                <Stack direction="row" spacing={2} alignItems="center">
                    {/* Search */}
                    <TextField
                        fullWidth
                        size="small"
                        placeholder="Search files and folders..."
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon fontSize="small" />
                                </InputAdornment>
                            ),
                            endAdornment: searchQuery && (
                                <InputAdornment position="end">
                                    <IconButton
                                        size="small"
                                        onClick={() => onSearchChange('')}
                                    >
                                        <ClearIcon fontSize="small" />
                                    </IconButton>
                                </InputAdornment>
                            ),
                        }}
                    />

                    {/* File Type Filter */}
                    <FormControl size="small" sx={{ minWidth: 150 }}>
                        <InputLabel>
                            <Stack direction="row" spacing={0.5} alignItems="center">
                                <FilterListIcon fontSize="small" />
                                <span>Type</span>
                            </Stack>
                        </InputLabel>
                        <Select
                            value={fileType}
                            label="Type"
                            onChange={(e) => onFileTypeChange(e.target.value)}
                        >
                            {FILE_TYPES.map((type) => (
                                <MenuItem key={type.value} value={type.value}>
                                    {type.label}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    {/* Sort By */}
                    <FormControl size="small" sx={{ minWidth: 150 }}>
                        <InputLabel>
                            <Stack direction="row" spacing={0.5} alignItems="center">
                                <SortIcon fontSize="small" />
                                <span>Sort</span>
                            </Stack>
                        </InputLabel>
                        <Select
                            value={sortBy}
                            label="Sort"
                            onChange={(e) => onSortByChange(e.target.value as any)}
                        >
                            {SORT_OPTIONS.map((option) => (
                                <MenuItem key={option.value} value={option.value}>
                                    {option.label}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    {/* Sort Order Toggle */}
                    <Tooltip title={`Sort ${sortOrder === 'asc' ? 'Ascending' : 'Descending'}`}>
                        <IconButton
                            size="small"
                            onClick={() => onSortOrderChange(sortOrder === 'asc' ? 'desc' : 'asc')}
                            sx={{
                                border: 1,
                                borderColor: 'divider',
                                borderRadius: 1,
                            }}
                        >
                            {sortOrder === 'asc' ? '↑' : '↓'}
                        </IconButton>
                    </Tooltip>
                </Stack>

                {/* Active Filters */}
                {hasActiveFilters && (
                    <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="caption" color="text.secondary">
                            Active filters:
                        </Typography>
                        {searchQuery && (
                            <Chip
                                label={`Search: "${searchQuery}"`}
                                size="small"
                                onDelete={() => onSearchChange('')}
                            />
                        )}
                        {fileType !== 'all' && (
                            <Chip
                                label={`Type: ${FILE_TYPES.find((t) => t.value === fileType)?.label}`}
                                size="small"
                                onDelete={() => onFileTypeChange('all')}
                            />
                        )}
                        <Button
                            size="small"
                            startIcon={<ClearIcon />}
                            onClick={onClearFilters}
                        >
                            Clear All
                        </Button>
                    </Stack>
                )}
            </Stack>
        </Paper>
    );
}
