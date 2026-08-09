import WidgetKit
import SwiftUI

// MARK: - 1. 급식 위젯 (MealWidget)

struct MealProvider: TimelineProvider {
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
        StaticConfiguration(kind: kind, provider: MealProvider()) { entry in
            MealWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("오늘의 급식")
        .description("오늘 학교 급식 메뉴를 바로 확인합니다.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}


// MARK: - 2. 시간표 위젯 (TimetableWidget)

struct TimetableProvider: TimelineProvider {
    func placeholder(in context: Context) -> TimetableEntry {
        TimetableEntry(date: Date(), timetableInfo: "오늘의 시간표 정보가 없습니다.")
    }

    func getSnapshot(in context: Context, completion: @escaping (TimetableEntry) -> ()) {
        completion(loadEntry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<TimetableEntry>) -> ()) {
        let entry = loadEntry()
        let timeline = Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(60 * 60)))
        completion(timeline)
    }

    func loadEntry() -> TimetableEntry {
        let defaults = UserDefaults(suiteName: "group.com.ymk.schoolapp")
        // App에서 시간표 데이터를 가져옵니다. (필요시 키 이름을 맞춰주세요)
        let timetableInfo = defaults?.string(forKey: "timetable") ?? "시간표 정보 없음"
        return TimetableEntry(date: Date(), timetableInfo: timetableInfo)
    }
}

struct TimetableEntry: TimelineEntry {
    let date: Date
    let timetableInfo: String
}

struct TimetableWidgetEntryView: View {
    @Environment(\.widgetFamily) var family
    var entry: TimetableEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("오늘의 시간표")
                .font(.system(size: family == .systemSmall ? 13 : 15, weight: .bold))
                .foregroundColor(.blue)

            Text(entry.timetableInfo)
                .font(.system(size: 13))
        }
        .padding()
    }
}

struct TimetableWidget: Widget {
    let kind: String = "TimetableWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: TimetableProvider()) { entry in
            TimetableWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("오늘의 시간표")
        .description("오늘의 수업 시간표를 바로 확인합니다.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}


// MARK: - 3. 위젯 번들 등록 (index.swift에서 쓸 수 있도록 두 위젯 묶음)