using Avalonia.Controls;
using Avalonia.Interactivity;
using LexicastUi.Services;

namespace LexicastUi.Views;

public partial class SettingsWindow : Window
{
    public SettingsWindow()
    {
        InitializeComponent();
        ApiUrlBox.Text = App.Settings.ApiUrl;
    }

    private void SaveButton_Click(object? sender, RoutedEventArgs e)
    {
        string apiUrl = ApiUrlBox.Text?.Trim() ?? string.Empty;
        if (string.IsNullOrEmpty(apiUrl))
        {
            return;
        }

        App.Settings.ApiUrl = apiUrl;
        App.ApiClient.BaseUrl = apiUrl;
        AppSettingsStore.Save(App.Settings);
        Close();
    }

    private void CancelButton_Click(object? sender, RoutedEventArgs e)
    {
        Close();
    }
}
