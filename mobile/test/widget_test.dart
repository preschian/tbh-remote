import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:tbh_remote/main.dart';
import 'package:tbh_remote/services/api.dart';
import 'package:tbh_remote/services/session.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  testWidgets('app shows paywall when not subscribed', (tester) async {
    await tester.pumpWidget(
      TbhRemoteApp(api: RemoteApi(), session: SessionStore()),
    );
    await tester.pump(); // start _refresh
    await tester.pump(const Duration(milliseconds: 50));
    expect(find.textContaining('Subscribe'), findsWidgets);
    expect(find.byType(CircularProgressIndicator), findsNothing);
  });
}
