import { useMemo, useState } from 'react';

export interface SearchFilterOptions {
    searchQuery: string;
    fileType: string;
    sortBy: 'name' | 'size' | 'date';
    sortOrder: 'asc' | 'desc';
}

export interface ObjectInfo {
    name: string;
    size: number;
    lastModified?: string;
    isDir?: boolean;
}

export function useSearchFilter<T extends ObjectInfo>(
    items: T[],
    options: SearchFilterOptions
): T[] {
    return useMemo(() => {
        let filtered = [...items];

        // Apply search filter
        if (options.searchQuery) {
            const query = options.searchQuery.toLowerCase();
            filtered = filtered.filter((item) =>
                item.name.toLowerCase().includes(query)
            );
        }

        // Apply file type filter
        if (options.fileType && options.fileType !== 'all') {
            filtered = filtered.filter((item) => {
                if (item.isDir) return options.fileType === 'folder';
                const ext = item.name.split('.').pop()?.toLowerCase() || '';

                switch (options.fileType) {
                    case 'image':
                        return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'ico'].includes(ext);
                    case 'document':
                        return ['pdf', 'doc', 'docx', 'txt', 'md'].includes(ext);
                    case 'code':
                        return ['js', 'ts', 'tsx', 'jsx', 'json', 'html', 'css', 'py', 'go', 'rs'].includes(ext);
                    case 'archive':
                        return ['zip', 'tar', 'gz', 'rar', '7z'].includes(ext);
                    default:
                        return true;
                }
            });
        }

        // Apply sorting
        filtered.sort((a, b) => {
            // Always put folders first
            if (a.isDir && !b.isDir) return -1;
            if (!a.isDir && b.isDir) return 1;

            let comparison = 0;
            switch (options.sortBy) {
                case 'name':
                    comparison = a.name.localeCompare(b.name);
                    break;
                case 'size':
                    comparison = a.size - b.size;
                    break;
                case 'date':
                    const dateA = a.lastModified ? new Date(a.lastModified).getTime() : 0;
                    const dateB = b.lastModified ? new Date(b.lastModified).getTime() : 0;
                    comparison = dateA - dateB;
                    break;
            }

            return options.sortOrder === 'asc' ? comparison : -comparison;
        });

        return filtered;
    }, [items, options]);
}
