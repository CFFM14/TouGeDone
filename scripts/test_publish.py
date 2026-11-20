import copy
import unittest
from publish import make_descriptor


class ReleaseMetadataTest(unittest.TestCase):
    def setUp(self):
        self.release = {'body': 'release notes', 'assets': [
            {'name': f'TouGeDone-v2.9.4{suffix}', 'state': 'uploaded',
             'digest': 'sha256:' + 'a' * 64,
             'browser_download_url': 'https://github.com/CFFM14/TouGeDone/releases/download/untagged-draft/file'}
            for suffix in ('.zip', '.zip.sha256')]}

    def test_draft_urls_are_replaced_with_final_tag_urls(self):
        original = copy.deepcopy(self.release)
        result = make_descriptor(self.release, 'v2.9.4')
        self.assertEqual(self.release, original)
        self.assertEqual(result['tag_name'], 'v2.9.4')
        self.assertFalse(result['draft'])
        self.assertFalse(result['prerelease'])
        for item in result['assets']:
            self.assertEqual(item['browser_download_url'],
                             'https://github.com/CFFM14/TouGeDone/releases/download/v2.9.4/' + item['name'])
            self.assertNotIn('untagged-', item['browser_download_url'])

    def test_invalid_digest_does_not_publish_metadata(self):
        for digest in (None, 'sha256:', 'sha256:' + 'g' * 64):
            self.release['assets'][0]['digest'] = digest
            with self.assertRaises(RuntimeError):
                make_descriptor(self.release, 'v2.9.4')


if __name__ == '__main__':
    unittest.main()
