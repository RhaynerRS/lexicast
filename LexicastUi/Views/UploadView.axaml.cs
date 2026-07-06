using System;
using System.IO;
using Avalonia.Controls;
using Avalonia.Interactivity;
using Avalonia.Platform.Storage;
using LexicastUi.Models;

namespace LexicastUi.Views;

public partial class UploadView : UserControl
{
    private readonly INavigationHost _host;
    private string? _selectedFilePath;

    public UploadView(INavigationHost host)
    {
        _host = host;
        InitializeComponent();
    }

    private async void PickFileButton_Click(object? sender, RoutedEventArgs e)
    {
        var topLevel = TopLevel.GetTopLevel(this);
        if (topLevel is null)
        {
            return;
        }

        var files = await topLevel.StorageProvider.OpenFilePickerAsync(new FilePickerOpenOptions
        {
            Title = "Selecionar arquivo EPUB",
            AllowMultiple = false,
            FileTypeFilter = new[] { new FilePickerFileType("EPUB") { Patterns = new[] { "*.epub" } } }
        });

        if (files.Count == 0)
        {
            return;
        }

        _selectedFilePath = files[0].Path.LocalPath;
        SelectedFileText.Text = files[0].Name;
    }

    private async void TranslateButton_Click(object? sender, RoutedEventArgs e)
    {
        HideError();

        if (string.IsNullOrEmpty(_selectedFilePath))
        {
            ShowError("Selecione um arquivo .epub antes de continuar.");
            return;
        }

        string targetLanguage = TargetLanguageBox.Text?.Trim() ?? string.Empty;
        if (string.IsNullOrEmpty(targetLanguage))
        {
            ShowError("Informe o idioma de destino.");
            return;
        }

        int concurrency = (int)(ConcurrencyBox.Value ?? 1);
        string? userPrompt = string.IsNullOrWhiteSpace(UserPromptBox.Text) ? null : UserPromptBox.Text!.Trim();
        string submitKindText = (SubmitKindBox.SelectedItem as ComboBoxItem)?.Content as string ?? nameof(SubmitKind.APPEND_BLOCK);
        var submitKind = Enum.Parse<SubmitKind>(submitKindText);

        TranslateButton.IsEnabled = false;
        SubmitProgressBar.IsVisible = true;

        try
        {
            var job = await App.ApiClient.CreateTranslationAsync(
                _selectedFilePath, targetLanguage, concurrency, userPrompt, submitKind);

            _host.ShowProgress(job.JobId, Path.GetFileName(_selectedFilePath));
        }
        catch (Exception ex)
        {
            ShowError(ex.Message);
        }
        finally
        {
            TranslateButton.IsEnabled = true;
            SubmitProgressBar.IsVisible = false;
        }
    }

    private void ShowError(string message)
    {
        ErrorText.Text = message;
        ErrorBanner.IsVisible = true;
    }

    private void HideError()
    {
        ErrorBanner.IsVisible = false;
    }
}
