using Avalonia.Controls;
using Avalonia.Interactivity;
using LexicastUi.Views;

namespace LexicastUi;

public partial class MainWindow : Window, INavigationHost
{
    public MainWindow()
    {
        InitializeComponent();
        ShowUpload();
    }

    public void ShowUpload()
    {
        RootContent.Content = new UploadView(this);
    }

    public void ShowProgress(string jobId, string sourceFileName)
    {
        RootContent.Content = new ProgressView(this, jobId, sourceFileName);
    }

    private async void SettingsButton_Click(object? sender, RoutedEventArgs e)
    {
        await new SettingsWindow().ShowDialog(this);
    }
}