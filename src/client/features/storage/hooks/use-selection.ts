import { useState, useCallback } from 'react';

export interface UseSelectionReturn {
    selectedItems: Set<string>;
    isSelected: (item: string) => boolean;
    toggleSelection: (item: string) => void;
    selectAll: (items: string[]) => void;
    clearSelection: () => void;
    selectedCount: number;
    hasSelection: boolean;
}

export function useSelection(): UseSelectionReturn {
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

    const isSelected = useCallback(
        (item: string) => selectedItems.has(item),
        [selectedItems]
    );

    const toggleSelection = useCallback((item: string) => {
        setSelectedItems((prev) => {
            const next = new Set(prev);
            if (next.has(item)) {
                next.delete(item);
            } else {
                next.add(item);
            }
            return next;
        });
    }, []);

    const selectAll = useCallback((items: string[]) => {
        setSelectedItems(new Set(items));
    }, []);

    const clearSelection = useCallback(() => {
        setSelectedItems(new Set());
    }, []);

    return {
        selectedItems,
        isSelected,
        toggleSelection,
        selectAll,
        clearSelection,
        selectedCount: selectedItems.size,
        hasSelection: selectedItems.size > 0,
    };
}
