import { Text, VStack } from '@expo/ui/swift-ui';
import { font, foregroundStyle, padding } from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

type TimetableWidgetProps = {
  gradeClass: string;     
  timetableList: string; 
};

const TimetableWidget = (props: TimetableWidgetProps, environment: WidgetEnvironment) => {
  'widget';

  const { gradeClass, timetableList } = props;
  const lines = timetableList.split('\n').filter(line => line.trim() !== '');


  if (environment.widgetFamily === 'systemSmall') {
    const visibleLines = lines.slice(0, 3);
    return (
      <VStack modifiers={[padding({ all: 12 })]}>
        <Text modifiers={[font({ weight: 'bold', size: 12 }), foregroundStyle('#556B2F')]}>
          {gradeClass}
        </Text>
        {visibleLines.map((line, idx) => (
          <Text key={idx} modifiers={[font({ size: 11 })]}>
            {line}
          </Text>
        ))}
        {lines.length > 3 && (
          <Text modifiers={[font({ size: 10 }), foregroundStyle('#8B95A1')]}>
            +{lines.length - 3}교시 더보기
          </Text>
        )}
      </VStack>
    );
  }


  const visibleLines = environment.widgetFamily === 'systemMedium' ? lines.slice(0, 5) : lines;

  return (
    <VStack modifiers={[padding({ all: 14 })]}>
      <Text modifiers={[font({ weight: 'bold', size: 15 }), foregroundStyle('#556B2F')]}>
        {gradeClass}
      </Text>
      {visibleLines.map((line, idx) => (
        <Text key={idx} modifiers={[font({ size: 13 })]}>
          {line}
        </Text>
      ))}
      {environment.widgetFamily === 'systemMedium' && lines.length > 5 && (
        <Text modifiers={[font({ size: 11 }), foregroundStyle('#8B95A1')]}>
          +{lines.length - 5}교시 더보기
        </Text>
      )}
    </VStack>
  );
};

export default createWidget('TimetableWidget', TimetableWidget);
