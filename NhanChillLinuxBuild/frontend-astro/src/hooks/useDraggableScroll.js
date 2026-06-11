import { useRef, useEffect } from 'react';

export function useDraggableScroll() {
  const ref = useRef(null);

  useEffect(() => {
    const ele = ref.current;
    if (!ele) return;

    let isDown = false;
    let startX;
    let scrollLeft;
    let isDragging = false;

    // Touch direction detection
    let touchStartX = 0;
    let touchStartY = 0;
    let touchDirection = null; // 'horizontal' | 'vertical' | null

    const onMouseDown = (e) => {
      isDown = true;
      isDragging = false;
      ele.classList.add('cursor-grabbing');
      ele.style.scrollSnapType = 'none';
      startX = e.pageX - ele.offsetLeft;
      scrollLeft = ele.scrollLeft;
    };

    const onMouseLeave = () => {
      isDown = false;
      ele.classList.remove('cursor-grabbing');
      ele.style.scrollSnapType = '';
    };

    const onMouseUp = () => {
      isDown = false;
      ele.classList.remove('cursor-grabbing');
      ele.style.scrollSnapType = '';
    };

    const onMouseMove = (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - ele.offsetLeft;
      const walk = (x - startX) * 2;
      if (Math.abs(walk) > 5) {
        isDragging = true;
      }
      ele.scrollLeft = scrollLeft - walk;
    };

    const onClick = (e) => {
      if (isDragging) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    // Touch events: detect swipe direction, allow vertical scroll to propagate
    const DIRECTION_THRESHOLD = 8;

    const onTouchStart = (e) => {
      touchDirection = null;
      if (e.touches.length === 1) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      }
    };

    const onTouchMove = (e) => {
      if (!e.touches.length) return;
      const dx = Math.abs(e.touches[0].clientX - touchStartX);
      const dy = Math.abs(e.touches[0].clientY - touchStartY);

      if (!touchDirection && (dx > DIRECTION_THRESHOLD || dy > DIRECTION_THRESHOLD)) {
        touchDirection = dx > dy ? 'horizontal' : 'vertical';
      }

      // If user is scrolling vertically, let it propagate naturally
      // by NOT preventing default and NOT interfering
      if (touchDirection === 'vertical') {
        ele.style.overflowX = 'hidden';
      } else {
        ele.style.overflowX = '';
      }
    };

    const onTouchEnd = () => {
      touchDirection = null;
      ele.style.overflowX = '';
    };

    ele.addEventListener('mousedown', onMouseDown);
    ele.addEventListener('mouseleave', onMouseLeave);
    ele.addEventListener('mouseup', onMouseUp);
    ele.addEventListener('mousemove', onMouseMove);
    ele.addEventListener('click', onClick, true);
    ele.addEventListener('touchstart', onTouchStart, { passive: true });
    ele.addEventListener('touchmove', onTouchMove, { passive: true });
    ele.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      ele.removeEventListener('mousedown', onMouseDown);
      ele.removeEventListener('mouseleave', onMouseLeave);
      ele.removeEventListener('mouseup', onMouseUp);
      ele.removeEventListener('mousemove', onMouseMove);
      ele.removeEventListener('click', onClick, true);
      ele.removeEventListener('touchstart', onTouchStart);
      ele.removeEventListener('touchmove', onTouchMove);
      ele.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

  return ref;
}
