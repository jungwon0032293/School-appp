import WidgetKit
import SwiftUI

@main
struct exportWidgets: WidgetBundle {
    var body: some Widget {
        // 급식 위젯 & 시간표 위젯 등록
        MealWidget()
        TimetableWidget()
        
        // 기존 컨트롤 및 라이브 액티비티가 실제로 존재하는 경우에만 남겨두세요.
        // widgetControl()
        // WidgetLiveActivity()
    }
}
