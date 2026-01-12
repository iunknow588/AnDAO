/**
 * 虚拟滚动列表组件
 * 
 * 用于优化长列表渲染性能
 * 只渲染可见区域的列表项
 */

import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import styled from 'styled-components';

interface VirtualListProps<T> {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  overscan?: number; // 额外渲染的项目数量（用于平滑滚动）
  onScroll?: (scrollTop: number) => void;
}

const Container = styled.div<{ height: number }>`
  height: ${props => props.height}px;
  overflow-y: auto;
  overflow-x: hidden;
  position: relative;
`;

const ListContainer = styled.div<{ height: number }>`
  height: ${props => props.height}px;
  position: relative;
`;

const ItemContainer = styled.div<{ top: number; height: number }>`
  position: absolute;
  top: ${props => props.top}px;
  left: 0;
  right: 0;
  height: ${props => props.height}px;
`;

/**
 * 虚拟滚动列表
 */
export function VirtualList<T>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  overscan = 3,
  onScroll,
}: VirtualListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  // 计算可见范围
  const visibleRange = useMemo(() => {
    const start = Math.floor(scrollTop / itemHeight);
    const end = Math.min(
      items.length - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight)
    );

    // 添加 overscan
    const startWithOverscan = Math.max(0, start - overscan);
    const endWithOverscan = Math.min(items.length - 1, end + overscan);

    return {
      start: startWithOverscan,
      end: endWithOverscan,
    };
  }, [scrollTop, itemHeight, containerHeight, items.length, overscan]);

  // 可见项目
  const visibleItems = useMemo(() => {
    return items.slice(visibleRange.start, visibleRange.end + 1);
  }, [items, visibleRange.start, visibleRange.end]);

  // 总高度
  const totalHeight = items.length * itemHeight;

  // 偏移量（用于占位）
  const offsetY = visibleRange.start * itemHeight;

  // 处理滚动
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const newScrollTop = e.currentTarget.scrollTop;
    setScrollTop(newScrollTop);
    onScroll?.(newScrollTop);
  }, [onScroll]);

  return (
    <Container
      ref={containerRef}
      height={containerHeight}
      onScroll={handleScroll}
    >
      <ListContainer height={totalHeight}>
        {visibleItems.map((item, index) => {
          const actualIndex = visibleRange.start + index;
          return (
            <ItemContainer
              key={actualIndex}
              top={actualIndex * itemHeight}
              height={itemHeight}
            >
              {renderItem(item, actualIndex)}
            </ItemContainer>
          );
        })}
      </ListContainer>
    </Container>
  );
}

