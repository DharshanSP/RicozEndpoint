import React, { useState, useEffect, useRef, useMemo, useCallback, type ElementType, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Search, X, CornerDownLeft, ArrowDown, ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SearchItem {
  id?: string;
  label: string;
  description?: string;
  path: string;
  icon?: ElementType | ReactNode;
  category?: string;
  keywords?: string[];
}

export interface GlobalSearchProps {
  items: SearchItem[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  placeholder?: string;
  className?: string;
  dialogClassName?: string;
  onSelect?: (item: SearchItem) => void;
  trigger?: ReactNode;
  showTrigger?: boolean;
}

export function GlobalSearch({
  items,
  open: controlledOpen,
  onOpenChange,
  placeholder = 'Search pages, actions, and resources...',
  className,
  dialogClassName,
  onSelect,
  trigger,
  showTrigger = false,
}: GlobalSearchProps) {
  const navigate = useNavigate();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : uncontrolledOpen;

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const setOpen = useCallback(
    (nextOpen: boolean) => {
      if (isControlled) {
        onOpenChange?.(nextOpen);
      } else {
        setUncontrolledOpen(nextOpen);
      }
    },
    [isControlled, onOpenChange],
  );

  // Global Ctrl+K / Cmd+K shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setOpen(!isOpen);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, setOpen]);

  // Focus input and reset query on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      // Small timeout ensures the DOM node is rendered before focusing
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Filter items based on user input
  const filteredItems = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) {
      return items;
    }

    const searchWords = trimmed.split(/\s+/).filter(Boolean);

    return items.filter((item) => {
      const labelText = item.label.toLowerCase();
      const descText = item.description ? item.description.toLowerCase() : '';
      const catText = item.category ? item.category.toLowerCase() : '';
      const pathText = item.path.toLowerCase();
      const keywordsText = item.keywords ? item.keywords.join(' ').toLowerCase() : '';

      const fullSearchContent = `${labelText} ${descText} ${catText} ${pathText} ${keywordsText}`;

      return searchWords.every((word) => fullSearchContent.includes(word));
    });
  }, [items, query]);

  // Reset selected index when filtered list changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredItems.length, query]);

  // Scroll active item into view
  useEffect(() => {
    if (isOpen && itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex]?.scrollIntoView({
        block: 'nearest',
      });
    }
  }, [selectedIndex, isOpen]);

  const handleSelectItem = useCallback(
    (item: SearchItem) => {
      setOpen(false);
      if (onSelect) {
        onSelect(item);
      } else if (item.path) {
        navigate(item.path);
      }
    },
    [navigate, onSelect, setOpen],
  );

  // Keyboard navigation within the dialog
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      return;
    }

    if (filteredItems.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % filteredItems.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % filteredItems.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selectedItem = filteredItems[selectedIndex];
      if (selectedItem) {
        handleSelectItem(selectedItem);
      }
    } else if (e.key === 'Home') {
      e.preventDefault();
      setSelectedIndex(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setSelectedIndex(filteredItems.length - 1);
    }
  };

  const renderIcon = (icon?: ElementType | ReactNode) => {
    if (!icon) {
      return <Search className="w-4 h-4 text-slate-400 shrink-0" />;
    }
    if (React.isValidElement(icon)) {
      return <span className="shrink-0">{icon}</span>;
    }
    const IconComponent = icon as ElementType;
    return <IconComponent className="w-4 h-4 text-slate-500 shrink-0 group-hover:text-blue-600 transition-colors" />;
  };

  // Group items by category if available
  const groupedItems = useMemo(() => {
    const hasCategories = filteredItems.some((item) => Boolean(item.category));
    if (!hasCategories) {
      return [{ category: null, items: filteredItems }];
    }

    const groups: { category: string | null; items: SearchItem[] }[] = [];
    const categoryMap = new Map<string | null, SearchItem[]>();

    filteredItems.forEach((item) => {
      const cat = item.category || 'General';
      if (!categoryMap.has(cat)) {
        categoryMap.set(cat, []);
      }
      categoryMap.get(cat)?.push(item);
    });

    categoryMap.forEach((catItems, cat) => {
      groups.push({ category: cat, items: catItems });
    });

    return groups;
  }, [filteredItems]);

  let globalIndexCounter = 0;

  const modalContent = isOpen ? (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-20 px-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Global Search"
    >
      <div
        className={cn(
          'w-full max-w-xl bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] sm:max-h-[580px] animate-in zoom-in-95 duration-150',
          dialogClassName,
        )}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
            {/* Search Input Bar */}
            <div className="flex items-center px-4 py-3 border-b border-slate-200 bg-white gap-3 shrink-0">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={placeholder}
                className="flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none min-w-0"
                autoComplete="off"
                autoCorrect="off"
                spellCheck="false"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    inputRef.current?.focus();
                  }}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 transition-colors shrink-0"
                  title="Clear query"
                >
                  <X className="w-4 h-4" />
                </button>
              ) : (
                <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium text-slate-400 bg-slate-100 border border-slate-200 rounded shrink-0">
                  ESC
                </kbd>
              )}
            </div>

            {/* Results List Area */}
            <div ref={listRef} className="flex-1 overflow-y-auto p-2 min-h-0 space-y-4">
              {filteredItems.length === 0 ? (
                <div className="py-12 px-4 text-center">
                  <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-slate-100 text-slate-400 mb-3">
                    <Search className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-medium text-slate-900 mb-1">
                    {query ? `No results found for "${query}"` : 'No items found'}
                  </h3>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto">
                    {query
                      ? 'Try checking for typos or searching for devices, policies, alerts, or settings.'
                      : 'There are no navigation items available to display.'}
                  </p>
                </div>
              ) : (
                groupedItems.map((group) => {
                  return (
                    <div key={group.category || 'all'} className="space-y-1">
                      {group.category && (
                        <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          {group.category}
                        </div>
                      )}
                      <div className="space-y-0.5">
                        {group.items.map((item) => {
                          const currentIndex = globalIndexCounter++;
                          const isSelected = currentIndex === selectedIndex;

                          return (
                            <button
                              key={`${item.path}-${item.label}-${currentIndex}`}
                              ref={(el) => {
                                itemRefs.current[currentIndex] = el;
                              }}
                              type="button"
                              onClick={() => handleSelectItem(item)}
                              onMouseMove={() => {
                                if (selectedIndex !== currentIndex) {
                                  setSelectedIndex(currentIndex);
                                }
                              }}
                              className={cn(
                                'group w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-xs transition-colors',
                                isSelected
                                  ? 'bg-blue-50/80 text-blue-900 border border-blue-100 shadow-xs'
                                  : 'text-slate-700 hover:bg-slate-50 border border-transparent',
                              )}
                            >
                              <div className="flex items-center gap-3 min-w-0 pr-2">
                                <div
                                  className={cn(
                                    'p-1.5 rounded-md shrink-0 transition-colors',
                                    isSelected
                                      ? 'bg-blue-100/70 text-blue-600'
                                      : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200 group-hover:text-slate-700',
                                  )}
                                >
                                  {renderIcon(item.icon)}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-medium text-slate-900 truncate flex items-center gap-2">
                                    <span className={cn(isSelected && 'text-blue-900 font-semibold')}>
                                      {item.label}
                                    </span>
                                  </div>
                                  {item.description && (
                                    <p className="text-[11px] text-slate-500 truncate mt-0.5">
                                      {item.description}
                                    </p>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-[10px] text-slate-400 font-mono hidden sm:inline-block">
                                  {item.path}
                                </span>
                                {isSelected && (
                                  <CornerDownLeft className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer with keyboard navigation cues */}
            <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500 shrink-0">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <span className="inline-flex items-center gap-0.5">
                    <kbd className="px-1 py-0.5 text-[10px] bg-white border border-slate-200 rounded font-mono text-slate-600 shadow-xs">
                      <ArrowUp className="w-2.5 h-2.5" />
                    </kbd>
                    <kbd className="px-1 py-0.5 text-[10px] bg-white border border-slate-200 rounded font-mono text-slate-600 shadow-xs">
                      <ArrowDown className="w-2.5 h-2.5" />
                    </kbd>
                  </span>
                  Navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 text-[10px] bg-white border border-slate-200 rounded font-mono text-slate-600 shadow-xs">
                    <CornerDownLeft className="w-2.5 h-2.5" />
                  </kbd>
                  Select
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 text-[10px] bg-white border border-slate-200 rounded font-mono text-slate-600 shadow-xs">
                    ESC
                  </kbd>
                  Close
                </span>
              </div>
              <div className="text-[10px] text-slate-400 font-medium">
                {filteredItems.length} {filteredItems.length === 1 ? 'result' : 'results'}
              </div>
            </div>
          </div>
        </div>
  ) : null;

  return (
    <>
      {/* Optional Trigger component */}
      {trigger ? (
        <div onClick={() => setOpen(true)} className="cursor-pointer">
          {trigger}
        </div>
      ) : showTrigger ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-md bg-slate-50 border border-slate-200 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors justify-between w-64',
            className,
          )}
        >
          <div className="flex items-center gap-2 truncate">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">{placeholder}</span>
          </div>
          <kbd className="px-1.5 py-0.5 text-[10px] bg-white border border-slate-200 rounded text-slate-500 shadow-xs shrink-0">
            Ctrl+K
          </kbd>
        </button>
      ) : null}

      {/* Portal modal to document body */}
      {typeof document !== 'undefined' && modalContent
        ? createPortal(modalContent, document.body)
        : null}
    </>
  );
}
