from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('stores', '0012_storereportexport'),
    ]

    operations = [
        migrations.AlterField(
            model_name='storereportexport',
            name='date_from',
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name='storereportexport',
            name='date_to',
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='storereportexport',
            name='report_type',
            field=models.CharField(db_index=True, default='sales', max_length=30),
        ),
        migrations.AddField(
            model_name='storereportexport',
            name='export_format',
            field=models.CharField(default='csv', max_length=10),
        ),
        migrations.AddField(
            model_name='storereportexport',
            name='row_count',
            field=models.PositiveIntegerField(default=0),
        ),
    ]