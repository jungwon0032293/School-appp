import WidgetKit
import SwiftUI

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> MealEntry {
        MealEntry(date: Date(), mealType: "오늘의 급식", mealList: "급식 정보 없음")
    }

    func getSnapshot(in context: Context, completion: @escaping (MealEntry) -> ()) {
        completion(loadEntry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<MealEntry>) -> ()) {
        let entry = loadEntry()
        let timeline = Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(60 * 60)))
        completion(timeline)
    }

    func loadEntry() -> MealEntry {
        let defaults = UserDefaults(suiteName: "group.com.ymk.schoolapp")
        let mealType = defaults?.string(forKey: "mealType") ?? "오늘의 급식"
        let mealList = defaults?.string(forKey: "mealList") ?? "급식 정보 없음"
        return MealEntry(date: Date(), mealType: mealType, mealList: mealList)
    }
}

struct MealEntry: TimelineEntry {
    let date: Date
    let mealType: String
    let mealList: String
}

struct MealWidgetEntryView: View {
    @Environment(\.widgetFamily) var family
    var entry: MealEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(entry.mealType)
                .font(.system(size: family == .systemSmall ? 13 : 15, weight: .bold))
                .foregroundColor(Color(red: 0.33, green: 0.42, blue: 0.18)) // #556B2F

            if family == .systemSmall {
                Text(entry.mealList.split(separator: "\n").first.map(String.init) ?? "")
                    .font(.system(size: 12))
            } else {
                Text(entry.mealList)
                    .font(.system(size: 13))
            }
        }
        .padding()
    }
}

struct MealWidget: Widget {
    let kind: String = "MealWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            MealWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("오늘의 급식")
        .description("오늘 학교 급식 메뉴를 바로 확인합니다.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
