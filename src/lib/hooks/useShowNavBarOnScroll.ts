import {useCallback, useRef} from 'react';
import {NativeScrollEvent, NativeSyntheticEvent} from 'react-native';
import useNavBarStore from '../zustand/navBarStore';

export const useShowNavBarOnScroll = () => {
  const {show, hide, isNavBarVisible} = useNavBarStore();
  const lastOffset = useRef(0);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const currentOffset = event.nativeEvent.contentOffset.y;
      const direction = currentOffset > lastOffset.current ? 'down' : 'up';

      // Show navbar if near top
      if (currentOffset < 50) {
        if (!isNavBarVisible) show();
      } 
      // Hide on scroll down, show on scroll up
      else if (Math.abs(currentOffset - lastOffset.current) > 10) {
        if (direction === 'down' && isNavBarVisible) {
          hide();
        } else if (direction === 'up' && !isNavBarVisible) {
          show();
        }
      }

      lastOffset.current = currentOffset;
    },
    [isNavBarVisible, show, hide],
  );

  return {handleScroll};
};
