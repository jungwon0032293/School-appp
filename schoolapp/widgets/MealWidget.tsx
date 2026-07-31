import { Text, VStack } from '@expo/ui/swift-ui';
import { font, foregroundStyle, padding } from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

// MealScreen.tsx의 updateWidgetData()가 넘기는 값과 일치하도록 타입을 정의합니다.
type MealWidgetProps = {
  mealType?: string; // 예: "7월 29일 급식"
  mealList?: string; // 줄바꿈(\n)으로 구분된 메뉴 텍스트
};

const MealWidget = (props: MealWidgetProps, environment: WidgetEnvironment) => {
  'widget';

  // props가 null/undefined일 경우 기본값 안전 처리
  const mealType = props?.mealType || '오늘의 급식';
  const mealList = props?.mealList || '급식 정보가 없습니다.';

  // mealList가 null이거나 빈 문자열일 때 예외 처리
  const safeMealList = mealList.trim() ? mealList : '급식 정보가 없습니다.';
  const firstMenuItem = safeMealList.split('\n')[0] || safeMealList;

  // Small 크기 위젯 (첫 번째 메뉴만 간단히 표시)
  if (environment.widgetFamily === 'systemSmall') {
    return (
      <VStack alignment="leading" spacing={6} modifiers={[padding({ all: 12 })]}>
        <Text modifiers={[font({ weight: 'bold', size: 13 }), foregroundStyle('#556B2F')]}>
          {mealType}
        </Text>
        <Text modifiers={[font({ size: 12 })]}>
          {firstMenuItem}
        </Text>
      </VStack>
    );
  }

  // Medium, Large 등 크기 위젯 (전체 메뉴 표시)
  return (
    <VStack alignment="leading" spacing={8} modifiers={[padding({ all: 14 })]}>
      <Text modifiers={[font({ weight: 'bold', size: 15 }), foregroundStyle('#556B2F')]}>
        {mealType}
      </Text>
      <Text modifiers={[font({ size: 13 })]}>
        {safeMealList}
      </Text>
    </VStack>
  );
};

// 첫 번째 인자: app.json의 name('MealWidget'), 두 번째 인자: 위젯 컴포넌트
export default createWidget('MealWidget', MealWidget);
