using Avalonia;
using Avalonia.Controls.ApplicationLifetimes;
using Avalonia.Markup.Xaml;
using LexicastUi.Models;
using LexicastUi.Services;

namespace LexicastUi;

public partial class App : Application
{
    /// <summary>
    /// App configuration persisted under the user's application-data folder.
    /// </summary>
    public static AppSettings Settings { get; } = AppSettingsStore.Load();

    /// <summary>
    /// Shared client used by every view to talk to the Python translation API.
    /// </summary>
    public static TranslationApiClient ApiClient { get; } = new TranslationApiClient { BaseUrl = Settings.ApiUrl };

    public override void Initialize()
    {
        AvaloniaXamlLoader.Load(this);
    }

    public override void OnFrameworkInitializationCompleted()
    {
        if (ApplicationLifetime is IClassicDesktopStyleApplicationLifetime desktop)
        {
            desktop.MainWindow = new MainWindow();
        }

        base.OnFrameworkInitializationCompleted();
    }
}